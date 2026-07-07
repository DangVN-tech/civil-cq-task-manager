# Civil&CQ Task Manager

Hệ thống quản lý công việc nội bộ cho phòng ~20 người. Truy cập từ bất kỳ đâu có Internet.
**100% miễn phí**: Supabase Free Tier (database, realtime, lưu file) + Vercel Free (hosting web).

Giao diện kiểu Outlook + Microsoft Planner: danh sách task bên trái, chi tiết bên phải,
thông báo hiện góc phải dưới màn hình.

---

## 1. Tính năng

| Nhóm | Nội dung |
|---|---|
| Phân quyền | Trưởng phòng (toàn quyền) · Phó phòng (xem dashboard + làm task) · Nhân viên |
| Đăng nhập | Chỉ nhập ID (ví dụ `nguyenvana`). Riêng Trưởng phòng thêm PIN 4 số, mặc định `0000`, bắt buộc đổi lần đầu |
| Task | Đầu mục, mô tả, ngày giao, deadline, ưu tiên (Khẩn/Gấp/Thường), Chủ trì + Phối hợp, tiến độ %, file, comment, activity log |
| Workflow | Tạo → thông báo → Chủ trì cập nhật tiến độ → xác nhận hoàn thành → tab Hoàn thành. Trưởng phòng có nút **Trả về** (bắt buộc lý do) |
| Thông báo | Realtime kiểu Outlook, góc phải dưới, xếp chồng, nút "Nhắc tôi sau" (mặc định 15 phút) — khi giao task, trước deadline 24h/8h/2h, khi đổi deadline. Bấm **"🔔 Bật thông báo màn hình"** để nhận thông báo hệ điều hành cả khi tab đang chạy nền/thu nhỏ (không cần Safari trên iPhone/iPad — chỉ hỗ trợ nếu cài như PWA) |
| File | Tối đa 6 file/lần, 50 MB/file, kéo thả, Download All (zip). Cho phép: pdf, doc(x), xls(x), ppt(x), zip, rar. Chặn: exe, bat, msi |
| Quản trị | Dashboard toàn phòng, quản lý nhân sự, quản lý dung lượng kho (cảnh báo 80%, nút Xóa file này) |

---

## 2. Cấu trúc thư mục

```
civil-cq-task-manager/
├─ supabase/schema.sql        ← chạy 1 lần trong Supabase SQL Editor (toàn bộ backend)
├─ src/
│  ├─ lib/                    ← supabase client, auth (hash PIN), phân quyền, xử lý file
│  ├─ types/                  ← TypeScript types + hằng số (giới hạn file, quota...)
│  ├─ hooks/                  ← React Query hooks: tasks, users, notifications, realtime, storage
│  ├─ context/                ← AuthContext (phiên đăng nhập)
│  ├─ components/
│  │  ├─ ui/                  ← Button, Dialog, Input... (tối giản, không animation)
│  │  ├─ layout/AppShell.tsx  ← khung Outlook 3 cột: header + sidebar + nội dung
│  │  ├─ task/                ← TaskCard, TaskDetail, TaskForm, FileSection, Comment...
│  │  └─ notify/ToastStack.tsx← thông báo góc phải dưới
│  └─ pages/                  ← Đăng nhập, Đang thực hiện, Hoàn thành, Dashboard,
│                               Nhân sự, Dung lượng, Tìm kiếm
├─ .env.example               ← mẫu cấu hình (URL + anon key của Supabase)
└─ vercel.json                ← cấu hình SPA cho Vercel
```

---

## 3. Bước 1 — Tạo backend Supabase (miễn phí, ~10 phút)

1. Vào **https://supabase.com** → *Start your project* → đăng ký (dùng GitHub hoặc email bất kỳ).
2. Bấm **New project**:
   - *Name*: `civil-cq-task-manager`
   - *Database Password*: đặt mật khẩu bất kỳ (lưu lại, ít khi cần dùng)
   - *Region*: **Southeast Asia (Singapore)** (gần Việt Nam nhất)
   - Plan: **Free**
3. Đợi ~2 phút để project khởi tạo.
4. Mở **SQL Editor** (menu trái) → **New query** → mở file `supabase/schema.sql`
   trong thư mục này, **copy toàn bộ** dán vào → bấm **Run**.
   Kết quả: tạo xong toàn bộ bảng, phân quyền, thông báo tự động, kho file,
   và tài khoản Trưởng phòng đầu tiên:
   - **ID: `admin`** — **PIN: `0000`** (đăng nhập lần đầu sẽ bắt buộc đổi PIN)
5. Lấy 2 thông số cho frontend (giao diện Supabase mới):
   - **Project URL**: vào **Project Settings** (bánh răng) → **Data API** (nhóm INTEGRATIONS)
     → copy ô `Project URL` → dán vào `VITE_SUPABASE_URL`.
     (Cũng chính là `https://<mã-project-trên-thanh-địa-chỉ>.supabase.co`)
   - **Key**: vào **Project Settings** → **API Keys** → tab *Publishable and secret API keys*
     → copy **Publishable key** (`sb_publishable_...`) → dán vào `VITE_SUPABASE_ANON_KEY`.
     Key này thay cho "anon key" cũ, dùng y hệt. **KHÔNG** dùng Secret key (`sb_secret_...`).

> Lưu ý: nếu bước Run báo lỗi ở dòng `cron.schedule` thì vào **Database → Extensions**,
> bật extension **pg_cron**, rồi chạy lại riêng câu lệnh `select cron.schedule(...)` cuối mục 4 của file SQL.

> **Gặp lỗi `type "user_role" already exists`?** Nghĩa là script đã chạy trước đó rồi (bấm Run 2 lần).
> Kiểm tra bằng câu lệnh `select login_id, full_name, role from users;`:
> - Hiện dòng `admin` → backend đã cài xong, bỏ qua lỗi, làm tiếp bước 5.
> - Báo lỗi `relation "users" does not exist` → chạy toàn bộ `supabase/reset.sql` để dọn sạch,
>   rồi chạy lại toàn bộ `schema.sql`.

---

## 4. Bước 2 — Chạy local

Yêu cầu: Node.js 20+.

```bash
cd civil-cq-task-manager
npm install

# Cấu hình: sao chép .env.example thành .env rồi điền 2 giá trị ở Bước 1.5
copy .env.example .env     # Windows (macOS/Linux: cp .env.example .env)

npm run dev
```

Mở http://localhost:5173 → đăng nhập bằng `admin` / PIN `0000` → đổi PIN
→ vào **Quản lý nhân sự** thêm người trong phòng → bắt đầu tạo task.

---

## 5. Bước 3 — Deploy lên Internet bằng Vercel (miễn phí)

### Cách A — Qua GitHub (khuyến nghị, tự deploy lại khi sửa code)

1. Đưa thư mục này lên 1 repo GitHub (private được).
2. Vào **https://vercel.com** → đăng nhập bằng GitHub → **Add New → Project** → chọn repo.
3. Vercel tự nhận Vite. Trước khi bấm Deploy, mở **Environment Variables** thêm:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
4. Bấm **Deploy** → nhận link dạng `https://civil-cq-task-manager.vercel.app`
   → gửi link cho cả phòng dùng.

### Cách B — Không cần GitHub (deploy từ máy)

```bash
npm i -g vercel
npm run build
vercel --prod
# lần đầu nó hỏi: chấp nhận mặc định; sau đó vào dashboard Vercel
# thêm 2 Environment Variables như trên rồi chạy lại: vercel --prod
```

---

## 6. Giới hạn Free Tier cần biết

| Giới hạn | Ý nghĩa | Hệ thống xử lý |
|---|---|---|
| Kho file **1 GB** tổng | Tổng mọi file đính kèm của cả phòng | Dashboard + trang "Quản lý dung lượng" có thanh %, cảnh báo đỏ từ 80%, Trưởng phòng xóa tay từng file |
| **50 MB / file** | File lớn hơn sẽ bị từ chối | App chặn ngay khi chọn file |
| Database 500 MB | Task/comment là chữ, nhiều năm mới đầy | Không cần lo |
| Realtime 200 kết nối | Phòng 20 người dùng thoải mái | Không cần lo |
| **Project tạm dừng sau 7 ngày không dùng** | Supabase Free tự pause khi không ai truy cập 7 ngày liền | Vào https://supabase.com/dashboard → bấm **Restore project** (~1 phút). Phòng dùng hằng ngày thì không bao giờ gặp |

## 7. Ghi chú bảo mật (đã thống nhất)

Hệ thống dùng đăng nhập bằng ID không mật khẩu (trừ Trưởng phòng có PIN) theo đúng yêu cầu
nghiệp vụ — nghĩa là **ai biết đường link + ID của một nhân viên thì vào xem được dữ liệu**.
Phù hợp công cụ nội bộ; không lưu dữ liệu mật trên hệ thống này.
PIN Trưởng phòng được băm SHA-256, không bao giờ gửi/lưu dạng thô, và tầng database
chặn đọc cột PIN từ client.
