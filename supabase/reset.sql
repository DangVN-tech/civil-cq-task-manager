-- ============================================================
-- RESET: dọn sạch mọi thứ schema.sql đã tạo, để chạy lại từ đầu.
-- CHỈ dùng khi schema.sql chạy lỗi giữa chừng (hoặc muốn cài lại).
-- CẢNH BÁO: xóa toàn bộ dữ liệu task/user/file đã có!
-- Chạy xong file này thì chạy lại toàn bộ schema.sql.
-- ============================================================

-- Hủy lịch pg_cron (nếu đã tạo)
select cron.unschedule(jobid) from cron.job where jobname = 'deadline-notifications';

-- Xóa bảng (kéo theo trigger, index, policy trên bảng)
drop table if exists notifications  cascade;
drop table if exists activity_log   cascade;
drop table if exists comments       cascade;
drop table if exists files          cascade;
drop table if exists task_marks     cascade;
drop table if exists task_assignees cascade;
drop table if exists tasks          cascade;
drop table if exists users          cascade;

-- Xóa function
drop function if exists fn_default_pin()            cascade;
drop function if exists fn_task_created()           cascade;
drop function if exists fn_assignee_added()         cascade;
drop function if exists fn_task_updated()           cascade;
drop function if exists fn_verify_pin(text, text)   cascade;
drop function if exists fn_change_pin(text, text, text) cascade;
drop function if exists fn_storage_usage()          cascade;
drop function if exists fn_deadline_notifications() cascade;

-- Xóa enum
drop type if exists user_role     cascade;
drop type if exists task_priority cascade;
drop type if exists task_status   cascade;
drop type if exists mark_color    cascade;
drop type if exists assign_role   cascade;
drop type if exists notif_type    cascade;
drop type if exists activity_type cascade;

-- Xóa policy + bucket storage
drop policy if exists anon_storage_select on storage.objects;
drop policy if exists anon_storage_insert on storage.objects;
drop policy if exists anon_storage_delete on storage.objects;
delete from storage.objects where bucket_id = 'task-files';
delete from storage.buckets where id = 'task-files';
