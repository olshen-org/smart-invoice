import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const fileUrl = body.fileUrl;
    
    if (!fileUrl) {
      return Response.json({ error: 'Missing fileUrl' }, { status: 400 });
    }

    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch file' }, { status: response.status });
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Detect content type from URL
    const ext = fileUrl.toLowerCase().split('.').pop().split('?')[0];
    const contentTypes = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    return Response.json({
      data: base64,
      contentType: contentType
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});