import { auth } from "@clerk/nextjs/server";
import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

// Signs Cloudinary upload-widget requests so the upload preset can be set to
// "signed" mode in the Cloudinary console. Without this, an unsigned preset
// lets anyone who knows its name upload arbitrary files into the account.

// The widget only needs these signed; refuse to sign anything else so a
// caller can't get a signature for destructive params (e.g. overwrite,
// eager transformations, arbitrary folders).
const ALLOWED_PARAMS = new Set(["timestamp", "source", "upload_preset"]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  let paramsToSign: Record<string, string>;
  try {
    ({ paramsToSign } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (
    !paramsToSign ||
    typeof paramsToSign !== "object" ||
    !Object.keys(paramsToSign).every((key) => ALLOWED_PARAMS.has(key)) ||
    paramsToSign.upload_preset !== "photosynth_ai"
  ) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return NextResponse.json({ signature });
}
