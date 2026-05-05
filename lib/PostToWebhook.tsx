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
      // Has File objects - use FormData
      body = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value instanceof File) {
          body.append(key, value);
        } else if (value !== null && value !== undefined) {
          body.append(key, String(value));
        }
      });
    } else {
      // No files - use JSON
      body = JSON.stringify(data);
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(webhookURL, {
      method: "POST",
      headers,
      body,
    });

    // 1. Safely extract the parsed JSON body data from the network response stream
    let responseData = null;
    if (response.ok) {
      responseData = await response.json();
    } else {
      responseData = { message: await response.text() };
    }

    const isOk = !!response.ok;
    const statusCode = Number(response.status);

    return { success: isOk, status: statusCode, data: responseData};
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
  const action = data.action ?? 'add'
  const baseUrl = isLocal ? process.env.TEST_N8N_DESK_WEBHOOK_URL : process.env.N8N_DESK_WEBHOOK_URL;
  const url = `${baseUrl}/${action}`

  console.info('Posting to webhook URL:', url);
  return postToWebhook(url, data);
};
