// Temporary: says only whether the server keys are set (no values).
export function GET() {
  return Response.json({
    service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    secret: !!process.env.SUPABASE_SECRET_KEY,
    url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
