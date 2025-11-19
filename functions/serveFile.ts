import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Buffer } from "node:buffer";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url } = await req.json();

        if (!file_url) {
            return Response.json({ error: "file_url is required" }, { status: 400 });
        }

        // Fetch the file from the URL
        const fileResponse = await fetch(file_url);
        
        if (!fileResponse.ok) {
            return Response.json({ error: "Failed to fetch file" }, { status: 500 });
        }
        
        const arrayBuffer = await fileResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = fileResponse.headers.get("content-type") || "application/pdf";

        // Return base64 encoded file data
        return Response.json({ 
            file_data: base64,
            content_type: contentType
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});