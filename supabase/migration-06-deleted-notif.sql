-- ============================================================
-- MIGRATION 06: Thông báo "Task/Đầu mục/Dự án bị xóa"
-- Chạy 1 lần trong Supabase SQL Editor (project đang vận hành).
-- Cài mới thì KHÔNG cần file này — schema.sql đã gộp sẵn.
--
-- Chỉ 1 câu lệnh, không có function/RPC nào tham chiếu giá trị enum
-- mới trong cùng batch nên KHÔNG cần tách 2 bước như migration-05.
-- ============================================================
alter type notif_type add value if not exists 'deleted';
