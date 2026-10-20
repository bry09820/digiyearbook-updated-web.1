<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Sinag-Bughaw')</title>
</head>
<body style="font-family:Inter,Arial,sans-serif;background:#f1f5f9;padding:40px 20px;margin:0;">
    <div style="max-width:520px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1d2b4b,#3f51b5);border-radius:16px 16px 0 0;padding:28px 32px;">
            <div style="color:#ffffff;font-size:15px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">Sinag-Bughaw</div>
            <div style="color:#fdb813;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">Digital Yearbook · NU Lipa</div>
        </div>
        <div style="background:#ffffff;border-radius:0 0 16px 16px;padding:36px 32px;box-shadow:0 8px 32px rgba(0,0,0,0.08);">
            @yield('body')
        </div>
        <div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:24px;line-height:1.6;">
            &copy; {{ date('Y') }} National University Lipa · Sinag-Bughaw<br>
            This message was sent because an administrator reviewed your registration.
        </div>
    </div>
</body>
</html>
