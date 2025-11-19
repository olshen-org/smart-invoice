import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Buffer } from "node:buffer";

export default Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

        let file_url;
        if (req.method === "GET") {
            const url = new URL(req.url);
            file_url = url.searchParams.get("file_url");
        } else {
            const body = await req.json();
            file_url = body.file_url;
        }

        if (!file_url) {
            return Response.json({ error: "file_url is required" }, { status: 400 });
        }

        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            return Response.json({ error: "Failed to fetch file" }, { status: 500 });
        }
        
        // Note: Returning Base64 to ensure safe transport through the SDK which expects JSON.
        // The client will convert this back to a Blob for inline rendering.
        const arrayBuffer = await fileResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = fileResponse.headers.get("content-type") || "application/pdf";

        return Response.json({ 
            file_data: base64,
            content_type: contentType
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});