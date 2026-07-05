-- ============================================================
-- NÂNG CẤP 02: Deadline không bắt buộc + Phối hợp ngoài phòng
-- Chạy TOÀN BỘ file này 1 lần trong Supabase SQL Editor,
-- TRƯỚC KHI bản frontend mới được deploy.
-- An toàn với dữ liệu hiện có, chạy lại lần 2 cũng không lỗi.
-- ============================================================

-- 1. Deadline được phép trống = công việc thường xuyên, cập nhật mỗi ngày
alter table tasks alter column deadline drop not null;

-- 2. Danh sách phối hợp ngoài phòng (nhập tự do, không cần tài khoản)
alter table tasks add column if not exists external_collabs text[] not null default '{}';

-- 3. Cập nhật trigger: xử lý an toàn khi deadline trống
create or replace function fn_task_updated() returns trigger
language plpgsql security definer as $$
begin
  new.updated_at := now();

  -- Tiến độ thay đổi
  if new.progress is distinct from old.progress and new.status = 'dang_thuc_hien' then
    insert into activity_log(task_id, event_type, detail)
    values (new.id, 'progress', 'Tiến độ cập nhật: ' || new.progress || '%');
  end if;

  -- Hoàn thành
  if new.status = 'hoan_thanh' and old.status = 'dang_thuc_hien' then
    new.completed_at := now();
    new.progress := 100;
    insert into activity_log(task_id, event_type, detail)
    values (new.id, 'completed', 'Hoàn thành');
  end if;

  -- Quay lại đang thực hiện (Trả về hoặc chủ trì bấm Sửa)
  if new.status = 'dang_thuc_hien' and old.status = 'hoan_thanh' then
    new.completed_at := null;
    new.completed_by := null;
    if new.last_return_reason is distinct from old.last_return_reason
       and new.last_return_reason is not null then
      insert into notifications(user_id, task_id, type, message)
      select ta.user_id, new.id, 'returned',
             'Task "' || new.title || '" bị trả về. Lý do: ' || new.last_return_reason
      from task_assignees ta where ta.task_id = new.id;
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
  end if;

  return new;
end $$;
