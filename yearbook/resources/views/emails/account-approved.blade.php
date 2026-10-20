@extends('emails.layouts.sinag')

@section('title', 'Your Sinag-Bughaw account has been approved')

@section('body')
    <div style="display:inline-block;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;background:#dcfce7;color:#166534;">Approved</div>
    <h1 style="color:#1d2b4b;font-size:22px;font-weight:900;margin:0 0 12px;">Congratulations, {{ $name }}!</h1>
    <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 16px;">
        Your Sinag-Bughaw account has been approved. You can now sign in to the NU Lipa Digital Yearbook with the email and password you registered.
    </p>
    <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 24px;">
        Welcome to the community. We are glad you are here.
    </p>
    <a href="{{ $loginUrl }}" style="display:inline-block;background:#1d2b4b;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px;">Sign in now</a>
@endsection
