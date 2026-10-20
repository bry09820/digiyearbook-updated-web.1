@extends('emails.layouts.sinag')

@section('title', 'Update on your Sinag-Bughaw registration')

@section('body')
    <div style="display:inline-block;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;background:#fee2e2;color:#991b1b;">Not approved</div>
    <h1 style="color:#1d2b4b;font-size:22px;font-weight:900;margin:0 0 12px;">Hello {{ $name }},</h1>
    <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 16px;">
        Thank you for registering for Sinag-Bughaw. After review, your registration request was not approved, so this account cannot be used to sign in.
    </p>
    <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0;">
        If you believe this was a mistake, please contact the yearbook administrator and they can take another look.
    </p>
@endsection
