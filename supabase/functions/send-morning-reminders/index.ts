// ============================================
// Send Morning Reminders Edge Function
// ============================================
// Sends motivational morning reminders at 8:30 AM Monday-Friday
// Creates notifications for all users with a random motivational quote
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Andrew Tate vibes motivational quotes
const MOTIVATIONAL_QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "The only way to lose is to quit.",
  "Hard work beats talent when talent doesn't work hard.",
  "Your comfort zone is your enemy.",
  "Winners focus on winning. Losers focus on winners.",
  "The man who moves a mountain begins by carrying away small stones.",
  "Success is not owned, it's rented. And rent is due every day.",
  "The only person you should try to be better than is who you were yesterday.",
  "Pain is temporary. Quitting lasts forever.",
  "Champions aren't made in the gym. Champions are made from something deep inside them.",
  "The harder you work, the harder it is to surrender.",
  "You either win or you learn. There's no losing.",
  "The moment you give up is the moment you let someone else win.",
  "Stop being afraid of what could go wrong and start being excited about what could go right.",
  "The only impossible journey is the one you never begin.",
  "Don't stop when you're tired. Stop when you're done.",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Dream bigger. Do bigger.",
  "Don't wait for opportunity. Create it.",
  "Some people want it to happen, some wish it would happen, others make it happen.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "If it doesn't challenge you, it doesn't change you.",
  "Your future is created by what you do today, not tomorrow.",
  "The way to get started is to quit talking and begin doing.",
  "Innovation distinguishes between a leader and a follower.",
  "The people who are crazy enough to think they can change the world are the ones who do.",
  "Don't be afraid to give up the good to go for the great.",
  "I find that the harder I work, the more luck I seem to have.",
  "The two most important days in your life are the day you are born and the day you find out why.",
  "If you are not willing to risk the usual, you will have to settle for the ordinary.",
  "Take up one idea. Make that one idea your life.",
  "The successful warrior is the average man with laser-like focus.",
  "Don't let yesterday take up too much of today.",
  "You learn more from failure than from success.",
  "If you are working on something exciting that you really care about, you don't have to be pushed. The vision pulls you.",
  "People who are crazy enough to think they can change the world, are the ones who do.",
  "We may encounter many defeats but we must not be defeated.",
  "The way to get started is to quit talking and begin doing.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "It is during our darkest moments that we must focus to see the light.",
  "Don't let the fear of losing be greater than the excitement of winning.",
  "You can't use up creativity. The more you use, the more you have.",
  "Dream big and dare to fail.",
  "The only way to do great work is to love what you do."
]

/**
 * Check if today is a weekday (Monday-Friday)
 */
function isWeekday(): boolean {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return dayOfWeek >= 1 && dayOfWeek <= 5 // Monday (1) through Friday (5)
}

/**
 * Get a random quote from the motivational quotes array
 */
function getRandomQuote(): string {
  const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)
  return MOTIVATIONAL_QUOTES[randomIndex]
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // Check if today is a weekday
    if (!isWeekday()) {
      console.log('Not a weekday, skipping morning reminders')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Not a weekday, no reminders sent',
          day: new Date().toLocaleDateString('en-US', { weekday: 'long' })
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Supabase client with service role (to create notifications for all users)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all users (regardless of status)
    const { data: allUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('id')
    
    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }
    
    // Send to all users (no status filtering)
    const users = allUsers || []

    if (!users || users.length === 0) {
      console.log('No users found')
      return new Response(
        JSON.stringify({ success: true, message: 'No users found', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Pick a random quote for today (same quote for everyone)
    const quote = getRandomQuote()
    const title = 'Good Morning -- Lets lock in'
    const message = quote

    console.log(`Sending morning reminders to ${users.length} users with quote: "${quote}"`)

    // Create notifications for all users
    const notifications = users.map(user => ({
      user_id: user.id,
      type: 'system',
      title: title,
      message: message,
      link: null,
      read: false,
      metadata: {
        reminder_type: 'morning_motivation',
        sent_at: new Date().toISOString()
      }
    }))

    // Insert all notifications in a single batch
    const { data: insertedNotifications, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select('id')

    if (insertError) {
      throw new Error(`Failed to create notifications: ${insertError.message}`)
    }

    const successCount = insertedNotifications?.length || 0

    console.log(`Successfully created ${successCount} morning reminder notifications`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Morning reminders sent successfully',
        users_notified: successCount,
        quote: quote,
        day: new Date().toLocaleDateString('en-US', { weekday: 'long' })
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending morning reminders:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
