"use server";

import { CaptureDataProps } from "@/app/types/activity";

const isLocal = process.env.NODE_ENV === "development";

const postToWebhook = async (webhookURL: string | undefined, data: any) => {
  const authSecret = process.env.N8N_WEBHOOK_SECRET;

  try {
    if (!webhookURL || !authSecret) {
      console.error("postToWebhook error: Missing environment variables");
      return { success: false, error: "Configuration error" };
    }

    // Convert data to FormData if it contains File objects
    let body: FormData | string;
    const headers: Record<string, string> = {
      "X-N8N-WEBHOOK-SECRET": authSecret,
    };

    if (data instanceof FormData) {
      body = data;
    } else if (typeof data === 'object' && data !== null && Object.values(data).some((v) => v instanceof File)) {
      // 1. Create a local instances explicitly typed as FormData
      const formData = new FormData();
      
      // 2. Loop and append securely to the guaranteed local FormData instance
      Object.entries(data).forEach(([key, value]) => {
        if (value instanceof File) {
          formData.append(key, value);
        } else if (value !== null && value !== undefined) {
          formData.append(key, String(value));
        }
      });

      // 3. Assign the complete FormData bundle to your wide-scope body variable
      body = formData;
    } else {
      // Fallback for regular objects without files
      body = JSON.stringify(data);
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(webhookURL, {
      method: "POST",
      headers,
      body,
    });

    const isOk = !!response.ok;
    const statusCode = Number(response.status);

    return { success: isOk, status: statusCode, data: null };
  } catch (error: any) {
    console.error("postToWebhook error:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
};

interface PostDeskProps extends CaptureDataProps {
  id: string
  action: 'add' | 'update' | 'archive'
}

export const postDesk = async (data: PostDeskProps) => {
  const baseUrl = isLocal ? process.env.TEST_N8N_DESK_WEBHOOK_URL : process.env.N8N_DESK_WEBHOOK_URL;

  console.info('Posting to webhook URL:', baseUrl);
  return postToWebhook(baseUrl, data);
};

