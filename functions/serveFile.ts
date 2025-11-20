import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    // Handle CORS preflight
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
        
        // Simply stream the body directly
        return new Response(fileResponse.body, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "inline; filename=receipt.pdf",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});