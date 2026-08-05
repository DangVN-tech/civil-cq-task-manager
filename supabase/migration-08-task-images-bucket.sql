-- Migration 08: bucket Storage cho ảnh dán vào Nhật ký xử lý ("Ghi nhật ký xử lý")
-- Thiếu bucket này khiến gửi nhật ký kèm ảnh báo lỗi (và làm mất luôn cả phần chữ đã gõ).

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-images', 'task-images', true, 10485760)  -- 10 MB / ảnh
on conflict (id) do nothing;

create policy anon_storage_images_select on storage.objects
  for select to anon using (bucket_id = 'task-images');
create policy anon_storage_images_insert on storage.objects
  for insert to anon with check (bucket_id = 'task-images');
