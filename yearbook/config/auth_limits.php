<?php

return [

    /*
    | How many Sanctum tokens (devices) one account may hold at once.
    | Set AUTH_MAX_SESSIONS=1 to allow a single active sign-in.
    */
    'max_sessions' => max(1, (int) env('AUTH_MAX_SESSIONS', 1)),

    /*
    | invalidate — signing in ends the other sessions for this account.
    | reject     — signing in is refused once the limit is already reached.
    */
    'on_exceeded' => env('AUTH_SESSION_ON_EXCEEDED', 'invalidate'),

];
