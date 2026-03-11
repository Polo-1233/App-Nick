import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  "https://ullvnvtyjmaclkrruhds.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHZudnR5am1hY2xrcnJ1aGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTc2MzUsImV4cCI6MjA4ODc3MzYzNX0.hThK9Dv858RWkb_59H3xhDkZJwD8kq6y4PyqwC4R-7M"
)

async function getToken() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "thomasjedi12@gmail.com",
    password: "test"
  })

  if (error) {
    console.log(error)
    return
  }

  console.log("JWT TOKEN:")
  console.log(data.session.access_token)
}

getToken()
