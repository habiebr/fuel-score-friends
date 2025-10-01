import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Get recent wearable data (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: wearableData } = await supabase
      .from("wearable_data")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false });

    // Get recent food logs
    const { data: foodLogs } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", sevenDaysAgo.toISOString())
      .order("logged_at", { ascending: false });

    // Calculate averages
    const avgCalories = wearableData && wearableData.length > 0
      ? Math.round(
          wearableData.reduce((sum, d) => sum + (d.calories_burned || 0), 0) /
            wearableData.length
        )
      : 2000;

    const avgSteps = wearableData && wearableData.length > 0
      ? Math.round(
          wearableData.reduce((sum, d) => sum + (d.steps || 0), 0) /
            wearableData.length
        )
      : 0;

    const avgFoodCalories = foodLogs && foodLogs.length > 0
      ? Math.round(
          foodLogs.reduce((sum, log) => sum + log.calories, 0) / foodLogs.length
        )
      : 0;

    // Build context for AI
    const context = `
User Profile:
- Age: ${profile?.age || "unknown"}
- Weight: ${profile?.weight || "unknown"} kg
- Height: ${profile?.height || "unknown"} cm
- Activity Level: ${profile?.activity_level || "moderate"}
- Fitness Goals: ${profile?.fitness_goals?.join(", ") || "general fitness"}

Recent Activity (7 days):
- Average calories burned: ${avgCalories} per day
- Average steps: ${avgSteps} per day
- Number of tracked workouts: ${wearableData?.length || 0}

Recent Nutrition (7 days):
- Average calorie intake: ${avgFoodCalories} per day
- Number of meals logged: ${foodLogs?.length || 0}

Task: Based on this data, provide personalized daily macronutrient recommendations. Consider:
1. Their activity level and calorie expenditure
2. Their fitness goals
3. Current nutrition habits
4. Standard nutrition guidelines for athletes

Respond with:
1. Daily calorie target
2. Protein grams
3. Carbs grams
4. Fat grams
5. Brief explanation (2-3 sentences) of why these numbers make sense

Format your response as JSON:
{
  "dailyCalories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "explanation": "string"
}
`;

    console.log("Calling AI for macro estimation");
    
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a sports nutrition expert. Provide data-driven, personalized nutrition advice.",
            },
            {
              role: "user",
              content: context,
            },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const estimation = JSON.parse(aiData.choices[0].message.content);

    console.log("AI estimation generated:", estimation);

    return new Response(JSON.stringify({ estimation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in estimate-macros function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
