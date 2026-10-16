<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OtpVerification extends Model
{
    protected $fillable = ['email', 'type', 'otp', 'expires_at', 'used', 'reset_token'];
    protected $casts = [
        'otp'        => 'string',
        'expires_at' => 'datetime',
        'used'       => 'boolean',
    ];
}