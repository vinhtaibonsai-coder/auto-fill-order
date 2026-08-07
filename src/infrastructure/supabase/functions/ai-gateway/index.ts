import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `
Bạn là AI chuyên bóc tách đơn hàng tiếng Việt. 
Trích xuất Name, Phone, Address, Ward, Province, District, Notes, COD (tiền thu hộ, số nguyên), Products (mảng object: name, quantity, price).
Chỉ trả về JSON thuần hợp lệ, không bọc trong markdown, không giải thích.
Format mong muốn:
{
  "name": "",
  "phone": "",
  "address": "",
  "ward": "",
  "district": "",
  "province": "",
  "notes": "",
  "cod": 0,
  "products": [{"name": "", "quantity": 1, "price": 0}]
}
`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify User Session (Supabase JWT)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // 2. Parse Request Body
    const { task, text, deviceId } = await req.json();
    if (!text) {
      throw new Error('Missing text in request body');
    }
    const rawText = text;

    // 3. Call Groq API
    // Note: The Groq API key is securely stored in Supabase Secrets (Deno.env)
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      throw new Error('Server configuration error: Missing GROQ_API_KEY');
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama3-70b-8192", // Or get from shop_settings/env
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: rawText }
        ],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: "json_object" }
      })
    });

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text();
      console.error('Groq Error:', errBody);
      throw new Error('AI Provider Error');
    }

    const groqData = await groqResponse.json();
    const resultContent = groqData.choices[0].message.content;

    let parsedJson = {};
    try {
      parsedJson = JSON.parse(resultContent);
    } catch (e) {
      throw new Error('Failed to parse AI response into JSON');
    }

    // (Future: Decrement AI Quota for the Shop here using a Supabase Service Role client)

    return new Response(JSON.stringify({
      success: true,
      taskId: task || 'parse',
      data: parsedJson
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
