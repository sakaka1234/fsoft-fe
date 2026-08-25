# Chạy bằng Docker

## Cách nhanh nhất

```bash
docker compose up --build
```

Mở http://localhost:4000. Không cần file cấu hình nào — Compose đã đặt sẵn URL
backend đang chạy trên Railway làm mặc định.

Muốn trỏ sang backend khác, hoặc bật đăng nhập Google:

```bash
cp .env.docker.example .env   # rồi sửa giá trị trong .env
docker compose up --build
```

## Không dùng Compose

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-backend/fsoft \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
  -t fsoft-fe .

docker run --rm -p 4000:4000 fsoft-fe
```

## Điều quan trọng nhất: biến môi trường được nướng vào lúc build

Hai biến `NEXT_PUBLIC_*` **không** được đọc lúc container khởi động. Next.js
thay thẳng giá trị của chúng vào bundle JavaScript trong lúc `next build`, nên:

- Phải truyền bằng `--build-arg`, truyền bằng `docker run -e` **sẽ không có tác dụng**
- Một image đã build gắn chặt với backend mà nó được build cùng
- Đổi backend nghĩa là **build lại**, không phải restart

Đây là lý do Dockerfile dừng build kèm thông báo lỗi khi thiếu
`NEXT_PUBLIC_API_BASE_URL`. Nếu không chặn, build vẫn chạy xong và mọi lời gọi
API trong container sẽ trỏ về chính origin của container, trông giống như
backend chết chứ không giống thiếu tham số.

Nếu thiếu `NEXT_PUBLIC_GOOGLE_CLIENT_ID` thì chỉ cảnh báo: app vẫn chạy, chỉ là
đăng nhập Google không dùng được.

## Đăng nhập Google trên origin mới

`googleRedirectUri()` trong [lib/auth/google.ts](lib/auth/google.ts) dựng URI từ
`window.location.origin`, nên nó theo đúng origin bạn phục vụ container. Google
so khớp URI từng ký tự, vì vậy origin đó phải được đăng ký sẵn trong Google
Cloud Console → Credentials → Authorized redirect URIs:

| Phục vụ tại | Phải đăng ký |
|---|---|
| `http://localhost:4000` | `http://localhost:4000/callback` |
| `https://app.example.com` | `https://app.example.com/callback` |

Chưa đăng ký thì màn hình đồng ý của Google sẽ báo `redirect_uri_mismatch`.

## Đổi port

Container luôn nghe cổng 4000 bên trong. Đổi cổng phía host thôi:

```bash
docker run --rm -p 8080:4000 fsoft-fe        # mở ở localhost:8080
PORT=8080 docker compose up --build           # tương đương, qua Compose
```

Muốn đổi cả cổng bên trong thì `docker run -e PORT=8080 -p 8080:8080`. Biến
`PORT` và `HOSTNAME` do `server.js` đọc lúc chạy nên không cần build lại.
`HOSTNAME` phải là `0.0.0.0`; nếu để mặc định localhost thì container không
tiếp nhận được kết nối từ ngoài dù đã `-p`.

## Ảnh image có gì

Build 4 tầng, chỉ tầng cuối được ship:

| Tầng | Việc |
|---|---|
| `base` | Node 22 Alpine, bật corepack |
| `deps` | `pnpm install --frozen-lockfile` |
| `builder` | `next build` |
| `runner` | Node thuần, không pnpm, không mã nguồn |

`next.config.ts` bật `output: "standalone"` **chỉ khi biến `BUILD_STANDALONE=1`**,
và tầng `builder` của Dockerfile là chỗ duy nhất đặt biến đó. Lý do: bật vô
điều kiện làm hỏng deploy trên Vercel (`ENOENT ... next-server.js.nft.json`),
vì Vercel có định dạng output riêng và không cần standalone. Nếu bạn build image
bằng cách khác Dockerfile này, nhớ truyền biến đó, không thì `.next/standalone`
sẽ không được tạo.

Khi đã bật, Next chỉ chép ra server và
đúng những file trong `node_modules` mà nó truy vết được là có dùng. Tầng
`runner` vì thế không cài dependency lần nào. Standalone cố ý bỏ qua `public/`
và `.next/static/` vì mặc định coi như có CDN phục vụ; ở đây không có CDN nên
Dockerfile tự chép hai thư mục đó vào.

Container chạy bằng user `nextjs` (uid 1001), không phải root.

## Kiểm tra sức khoẻ

Dockerfile có sẵn `HEALTHCHECK` gọi `/` mỗi 30 giây bằng `fetch` của Node 22
(không cần cài `curl` hay `wget` vào image). Xem trạng thái:

```bash
docker ps                      # cột STATUS hiện (healthy) / (unhealthy)
docker inspect --format '{{json .State.Health}}' <container>
```

## Khi lên production

- Đặt reverse proxy (nginx, Caddy, hoặc ingress) trước container thay vì phơi
  thẳng ra internet — đây là khuyến nghị trong tài liệu self-hosting của Next.
- Chạy nhiều instance thì cache ISR không dùng chung giữa các pod. Hiện app
  không có trang ISR nào nên chưa thành vấn đề, nhưng cần nhớ nếu sau này thêm.
