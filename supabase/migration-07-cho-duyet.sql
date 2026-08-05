-- ============================================================
-- MIGRATION 07: Bước "Chờ duyệt" trước khi hoàn thành task
-- Cài mới thì KHÔNG cần file này — schema.sql đã gộp sẵn.
--
-- QUAN TRỌNG: Postgres không cho phép dùng giá trị enum mới thêm
-- trong CÙNG 1 lần chạy (transaction) — phải chạy 2 bước riêng biệt:
--   BƯỚC 1: chạy khối "1. Mở rộng enum" bên dưới, bấm Run.
--   BƯỚC 2: sau khi Bước 1 chạy xong, chạy toàn bộ phần còn lại (từ
--           mục 2 trở đi), bấm Run.
-- ============================================================

-- ===== BƯỚC 1 (chạy riêng, bấm Run, rồi mới sang Bước 2) =====
-- 1. Mở rộng enum: trạng thái task mới + loại activity/thông báo mới
alter type task_status add value if not exists 'cho_duyet';
alter type activity_type add value if not exists 'submitted_for_review';
alter type notif_type add value if not exists 'pending_approval';

-- ===== BƯỚC 2 (chạy sau khi Bước 1 đã chạy xong) =====

-- 2. Cập nhật trigger xử lý thay đổi task: thêm nhánh gửi duyệt + đổi
--    điều kiện hoàn thành thật (giờ chỉ hoàn thành từ Chờ duyệt) + mở
--    rộng nhánh "quay lại Đang thực hiện" để nhận cả Trả về từ Chờ duyệt
--    và Hủy gửi duyệt (không có lý do -> không bắn thông báo/activity).
create or replace function fn_task_updated() returns trigger
language plpgsql security definer as $$
begin
  new.updated_at := now();

  -- Tiến độ thay đổi
  if new.progress is distinct from old.progress and new.status = 'dang_thuc_hien' then
    insert into activity_log(task_id, event_type, detail)
    values (new.id, 'progress', 'Tiến độ cập nhật: ' || new.progress || '%');
  end if;

  -- Chủ trì bấm "Hoàn tất": gửi duyệt lên Trưởng phòng
  if new.status = 'cho_duyet' and old.status = 'dang_thuc_hien' then
    insert into activity_log(task_id, event_type, detail)
    values (new.id, 'submitted_for_review', 'Gửi duyệt hoàn thành');
    insert into notifications(user_id, task_id, type, message)
    select u.id, new.id, 'pending_approval',
           'Task "' || new.title || '" đang chờ bạn duyệt hoàn thành.'
    from users u where u.role = 'truong_phong' and u.is_admin = false;
  end if;

  -- Trưởng phòng xác nhận hoàn thành (chỉ từ Chờ duyệt)
  if new.status = 'hoan_thanh' and old.status = 'cho_duyet' then
    new.completed_at := now();
    new.progress := 100;
    insert into activity_log(task_id, event_type, detail)
    values (new.id, 'completed', 'Hoàn thành');
  end if;

  -- Quay lại đang thực hiện: Trả về (từ Hoàn thành hoặc Chờ duyệt, có lý do)
  -- hoặc Hủy gửi duyệt (từ Chờ duyệt, không có lý do -> im lặng, không báo)
  if new.status = 'dang_thuc_hien' and old.status in ('hoan_thanh', 'cho_duyet') then
    new.completed_at := null;
    new.completed_by := null;
    if new.last_return_reason is distinct from old.last_return_reason
       and new.last_return_reason is not null then
      insert into notifications(user_id, task_id, type, message)
      select ta.user_id, new.id, 'returned',
             'Task "' || new.title || '" bị trả về. Lý do: ' || new.last_return_reason
      from task_assignees ta where ta.task_id = new.id;

      insert into activity_log(task_id, event_type, detail)
      values (new.id, 'returned', 'Trả về. Lý do: ' || new.last_return_reason);
    end if;
  end if;

  -- Deadline thay đổi (kể cả thêm mới hoặc bỏ deadline)
  if new.deadline is distinct from old.deadline then
    delete from notifications
    where task_id = new.id
      and type in ('deadline_24h', 'deadline_8h', 'deadline_2h');
    insert into notifications(user_id, task_id, type, message)
    select ta.user_id, new.id, 'deadline_changed',
           case
             when new.deadline is null then
               'Task "' || new.title || '" không còn deadline (công việc thường xuyên).'
             else
               'Deadline task "' || new.title || '" đã đổi thành ' ||
               to_char(new.deadline at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
           end
    from task_assignees ta where ta.task_id = new.id;

    insert into activity_log(task_id, event_type, detail)
    values (new.id, 'deadline_changed',
            case
              when new.deadline is null then 'Bỏ deadline (chuyển thành công việc thường xuyên)'
              else 'Deadline đổi thành ' ||
                   to_char(new.deadline at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
            end);
  end if;

  return new;
end $$;

-- 3. Cập nhật fn_activity_feed: join thêm task đang Chờ duyệt (không chỉ
--    Đang thực hiện) + hiện thêm event 'submitted_for_review' trong feed,
--    để Trưởng phòng thấy badge/"Cập nhật mới nhất" khi có task chờ duyệt.
create or replace function fn_activity_feed(p_user_id uuid, p_limit int default 200)
returns table(
  id bigint, task_id uuid, task_title text, project_name text, group_name text,
  event_type activity_type, detail text, actor_id uuid, actor_name text,
  actor_is_truong_phong boolean, created_at timestamptz, is_read boolean
)
language sql stable as $$
  select al.id, al.task_id, t.title, p.name, g.name,
         al.event_type, al.detail, al.actor_id, u.full_name,
         coalesce(u.role = 'truong_phong' and not u.is_admin, false),
         al.created_at,
         exists(select 1 from activity_reads r where r.activity_id = al.id and r.user_id = p_user_id)
  from activity_log al
  join tasks t on t.id = al.task_id and t.status in ('dang_thuc_hien', 'cho_duyet')
  join task_groups g on g.id = t.group_id
  join projects p on p.id = g.project_id
  left join users u on u.id = al.actor_id
  where al.event_type in ('comment','deadline_changed','returned','file_uploaded','submitted_for_review')
  order by al.created_at desc
  limit p_limit
$$;
