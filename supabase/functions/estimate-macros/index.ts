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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    
    // Create client with anon key and user's auth header for proper RLS
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("Unauthorized");
    }

    console.log("User authenticated:", user.id);

    // Get user profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Get recent wearable data (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: wearableData } = await supabaseClient
      .from("wearable_data")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false });

    // Get today's specific data
    const today = new Date().toISOString().split("T")[0];
    const { data: todayData } = await supabaseClient
      .from("wearable_data")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    // Get recent food logs
    const { data: foodLogs } = await supabaseClient
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

    const avgHeartRate = wearableData && wearableData.length > 0
      ? Math.round(
          wearableData.reduce((sum, d) => sum + (d.heart_rate_avg || 0), 0) /
            wearableData.length
        )
      : 0;

    const avgSleep = wearableData && wearableData.length > 0
      ? (wearableData.reduce((sum, d) => sum + (d.sleep_hours || 0), 0) /
          wearableData.length).toFixed(1)
      : 0;

    const avgDistance = wearableData && wearableData.length > 0
      ? (wearableData.reduce((sum, d) => sum + (d.distance_meters || 0), 0) /
          wearableData.length / 1000).toFixed(1)
      : 0;

    const avgFoodCalories = foodLogs && foodLogs.length > 0
      ? Math.round(
          foodLogs.reduce((sum, log) => sum + log.calories, 0) / foodLogs.length
        )
      : 0;

    // Build context for AI
    const context = `
You are an expert sports nutritionist and performance coach. Analyze the following comprehensive data to create personalized daily nutrition recommendations.

User Profile:
- Age: ${profile?.age || "Not provided"}
- Weight: ${profile?.weight || "Not provided"} kg
- Height: ${profile?.height || "Not provided"} cm
- Activity Level: ${profile?.activity_level || "Not provided"}
- Fitness Goals: ${profile?.fitness_goals?.join(", ") || "Not provided"}

Today's Activity Metrics:
- Calories burned: ${todayData?.calories_burned || 0} kcal
- Steps: ${todayData?.steps || 0}
- Distance: ${todayData?.distance_meters ? (todayData.distance_meters / 1000).toFixed(2) : 0} km
- Average heart rate: ${todayData?.heart_rate_avg || "N/A"} bpm
- Max heart rate: ${todayData?.max_heart_rate || "N/A"} bpm
- Sleep hours: ${todayData?.sleep_hours || "N/A"}
- Training effect: ${todayData?.training_effect || "N/A"}
- Recovery time needed: ${todayData?.recovery_time || "N/A"} hours
- Activity type: ${todayData?.activity_type || "general"}

7-Day Activity Trends:
- Average calories burned: ${avgCalories} kcal/day
- Average steps: ${avgSteps} steps/day
- Average heart rate: ${avgHeartRate} bpm
- Average sleep: ${avgSleep} hours/night
- Average distance: ${avgDistance} km/day

Recent Nutrition (Last 7 days average):
- Average food calories: ${avgFoodCalories} kcal/day

IMPORTANT: Provide specific, actionable macronutrient targets and insights based on:
1. Their stated fitness goals and today's specific activity level
2. Wearable metrics (training load, recovery status, sleep quality)
3. Industry-standard macro ratios for their goal
4. Any gaps between their current intake and needs
5. Recovery needs based on training effect and heart rate data

Return your response as a JSON object with this EXACT structure:
{
  "dailyCalories": <number>,
  "protein": <number in grams>,
  "carbs": <number in grams>,
  "fat": <number in grams>,
  "insights": [
    "<insight about their current activity level>",
    "<insight about recovery needs if training effect is high>",
    "<insight about sleep and its impact on nutrition needs>"
  ],
  "recommendations": [
    "<specific actionable nutrition recommendation for today>",
    "<food timing or type recommendation based on activity>",
    "<hydration or supplement suggestion if relevant>"
  ],
  "explanation": "<single paragraph explaining the overall strategy>"
}

CRITICAL: Return ONLY the JSON object, no other text.
`;

    console.log("Calling Gemini AI for macro estimation with context:", {
      hasProfile: !!profile,
      hasTodayData: !!todayData,
      wearableDataCount: wearableData?.length || 0,
      foodLogsCount: foodLogs?.length || 0,
    });
    
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
              content: "You are an expert sports nutritionist. Analyze wearable data and provide personalized nutrition advice. Always return valid JSON.",
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
      console.error("Gemini AI API error:", aiResponse.status, errorText);
      throw new Error(`Gemini AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log("Raw Gemini response:", aiData);
    
    let estimation;
    try {
      estimation = JSON.parse(aiData.choices[0].message.content);
      console.log("Parsed estimation:", estimation);
      
      // Ensure all required fields exist
      if (!estimation.dailyCalories || !estimation.protein || !estimation.carbs || !estimation.fat) {
        console.error("Missing required fields in estimation:", estimation);
        throw new Error("Invalid estimation format from AI");
      }
      
      // Add default arrays if missing
      if (!estimation.insights) estimation.insights = [];
      if (!estimation.recommendations) estimation.recommendations = [];
      if (!estimation.explanation) estimation.explanation = "Personalized nutrition plan based on your data.";
      
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError, "Raw content:", aiData.choices[0].message.content);
      throw new Error("Failed to parse AI response as JSON");
    }

    console.log("Final estimation to return:", estimation);

    return new Response(JSON.stringify({ estimation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in estimate-macros function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("Error details:", { message: errorMessage, stack: errorStack });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorStack,
        debug: "Check edge function logs for more information"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
