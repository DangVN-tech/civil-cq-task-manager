-- ============================================================
-- MIGRATION 04: Thông báo realtime khi có nhật ký xử lý mới
-- Chạy 1 lần trong Supabase SQL Editor (project đang vận hành).
-- Cài mới thì KHÔNG cần file này — schema.sql đã gộp sẵn.
-- ============================================================

-- 1. Thêm loại thông báo 'comment'
alter type notif_type add value if not exists 'comment';

-- 2. Ghi nhật ký -> thông báo người tham gia task (trừ người viết) + Trưởng phòng thật
create or replace function fn_comment_added() returns trigger
language plpgsql security definer as $$
declare
  v_title  text;
  v_author text;
begin
  -- Chỉ thông báo khi task đang thực hiện
  select t.title into v_title
  from tasks t where t.id = new.task_id and t.status = 'dang_thuc_hien';
  if v_title is null then return new; end if;

  -- Lý do trả về đã có thông báo 'returned' riêng -> bỏ qua để không báo trùng
  if new.content like 'Lý do trả về:%' then return new; end if;

  select full_name into v_author from users where id = new.user_id;

  insert into notifications(user_id, task_id, type, message)
  select u.id, new.task_id, 'comment',
         coalesce(v_author, 'Ai đó') || ' ghi nhật ký ở task "' || v_title || '": ' ||
         left(new.content, 120) || case when length(new.content) > 120 then '…' else '' end
  from users u
  where u.id <> new.user_id
    and u.is_admin = false
    and (
      exists (select 1 from task_assignees ta
              where ta.task_id = new.task_id and ta.user_id = u.id)
      or u.role = 'truong_phong'
    );
  return new;
end $$;

drop trigger if exists trg_comment_added on comments;
create trigger trg_comment_added after insert on comments
  for each row execute function fn_comment_added();
