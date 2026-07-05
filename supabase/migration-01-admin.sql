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

-- 4. PIN DÙNG CHUNG (cơ chế chéo):
--    Admin KHÔNG có PIN riêng - đăng nhập bằng chính PIN của Trưởng phòng thật.
--    Chỉ Trưởng phòng đổi được PIN; Trưởng phòng chia sẻ PIN = cho phép Admin vào.
create or replace function fn_verify_pin(p_login_id text, p_pin_hash text)
returns boolean language plpgsql security definer as $$
declare v_ok boolean;
begin
  select case
    when u.is_admin then exists (
      select 1 from users tp
      where tp.role = 'truong_phong' and tp.is_admin = false
        and tp.pin_hash = p_pin_hash
    )
    else u.pin_hash = p_pin_hash
  end
  into v_ok
  from users u
  where u.login_id = p_login_id and u.role = 'truong_phong';
  return coalesce(v_ok, false);
end $$;
