import { useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useScreenshotGuards } from "@/utils/contentProtection";
import PrivacyScreen from "@/components/privacy/PrivacyScreen";
import UserWatermark from "@/components/privacy/UserWatermark";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/terms",
  "/privacy",
  "/maintenance",
]);

function isSensitivePath(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return false;
  if (pathname.startsWith("/sso/")) return false;
  return true;
}

export default function ScreenProtection() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const enabled = Boolean(user?.email) && isSensitivePath(pathname);
  const name = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();

  useScreenshotGuards(enabled);

  return (
    <>
      {enabled && <UserWatermark name={name} email={user.email} />}
      <PrivacyScreen enabled={enabled} />
    </>
  );
}
