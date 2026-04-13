namespace :tesco do
  desc "Capture Tesco cookies from running CDP Chrome and save to user's session"
  task :capture_cookies, [:email] => :environment do |_t, args|
    email = args[:email] || ENV["EMAIL"]
    cdp_url = ENV.fetch("CHROME_CDP_URL", "http://localhost:9222")

    abort "Usage: rake tesco:capture_cookies[user@email.com] or EMAIL=user@email.com rake tesco:capture_cookies" unless email

    user = User.find_by!(email: email)
    puts "Capturing cookies from CDP Chrome at #{cdp_url} for #{user.email}..."

    result = SidecarClient.new.capture_cookies(cdp_url: cdp_url)
    storage_state = result["storageState"]

    user.update!(
      tesco_session_state: storage_state.is_a?(String) ? storage_state : storage_state.to_json,
      tesco_session_saved_at: Time.current
    )

    cookie_count = storage_state.is_a?(Hash) ? storage_state["cookies"]&.length : JSON.parse(storage_state)["cookies"]&.length rescue 0
    puts "Saved #{cookie_count} cookies to #{user.email}'s session."
    puts "You can now stop bin/chrome-tesco — builds will use saved cookies headlessly."
  end
end
