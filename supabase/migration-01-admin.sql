-- ============================================================
-- NÂNG CẤP 01: Vai trò Admin (quản trị viên hệ thống)
-- Chạy TOÀN BỘ file này 1 lần trong Supabase SQL Editor,
-- TRƯỚC KHI bản frontend mới được deploy.
-- An toàn với dữ liệu hiện có, chạy lại lần 2 cũng không lỗi.
-- ============================================================

-- 1. Cột đánh dấu tài khoản Admin (tách khỏi Trưởng phòng thật)
alter table users add column if not exists is_admin boolean not null default false;

-- 2. Tài khoản 'admin' hiện tại trở thành Admin hệ thống
update users set is_admin = true where login_id = 'admin';

-- 3. Cho phép client đọc cột mới (bảng users đang dùng grant theo từng cột)
grant select (is_admin) on users to anon;

-- 4. Cơ chế chéo: Trưởng phòng đặt / đổi PIN cho Admin.
--    Admin không tự đổi được PIN của mình — phải xin Trưởng phòng.
create or replace function fn_set_admin_pin(p_new_hash text)
returns boolean language plpgsql security definer as $$
declare v_count int;
begin
  update users set pin_hash = p_new_hash, pin_changed = true where is_admin = true;
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;
