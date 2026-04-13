require "net/http"

class SidecarClient
  class Error < StandardError; end

  def self.start_build(basket_build, callback_base_url:)
    new.start_build(basket_build, callback_base_url: callback_base_url)
  end

  def self.send_existing_basket_decision(basket_build, action)
    new.send_existing_basket_decision(basket_build, action)
  end

  def self.search(query)
    new.search(query)
  end

  def self.start_tesco_login
    new.start_tesco_login
  end

  def self.poll_tesco_login(login_id)
    new.poll_tesco_login(login_id)
  end

  def self.complete_tesco_login(login_id)
    new.complete_tesco_login(login_id)
  end

  def self.cancel_tesco_login(login_id)
    new.cancel_tesco_login(login_id)
  end

  def search(query)
    body = { query: query }.to_json
    sig  = OpenSSL::HMAC.hexdigest("SHA256", secret, body)
    uri  = URI("#{base_url}/search")
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["X-Signature"]  = sig
    req.body = body
    res = Net::HTTP.start(uri.host, uri.port, open_timeout: 5, read_timeout: 30) { |http| http.request(req) }
    raise Error, "sidecar search #{res.code}: #{res.body}" unless res.code.to_i == 200
    JSON.parse(res.body).fetch("results", [])
  end

  def start_build(basket_build, callback_base_url:)
    user = basket_build.user
    payload = {
      buildId: basket_build.id,
      userId: user.id,
      items: basket_build.list_snapshot,
      preferences: {
        price_range: user.price_range,
        organic_preference: user.organic_preference,
      },
      railsCallbackBase: callback_base_url,
      tescoSessionState: user.tesco_session_state,
    }
    body = payload.to_json
    sig  = OpenSSL::HMAC.hexdigest("SHA256", secret, body)

    uri = URI("#{base_url}/build")
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["X-Signature"]  = sig
    req.body = body

    res = Net::HTTP.start(uri.host, uri.port, open_timeout: 5, read_timeout: 10) do |http|
      http.request(req)
    end
    unless res.code.to_i == 202
      raise Error, "sidecar #{res.code}: #{res.body}"
    end
    true
  end

  def start_tesco_login
    body = {}.to_json
    sig  = OpenSSL::HMAC.hexdigest("SHA256", secret, body)
    uri  = URI("#{base_url}/tesco-login")
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["X-Signature"]  = sig
    req.body = body
    res = Net::HTTP.start(uri.host, uri.port, open_timeout: 5, read_timeout: 30) { |http| http.request(req) }
    raise Error, "sidecar tesco-login #{res.code}: #{res.body}" unless res.code.to_i == 202
    JSON.parse(res.body)
  end

  def poll_tesco_login(login_id)
    sig = OpenSSL::HMAC.hexdigest("SHA256", secret, "")
    uri = URI("#{base_url}/tesco-login/#{login_id}/status")
    req = Net::HTTP::Get.new(uri)
    req["X-Signature"] = sig
    res = Net::HTTP.start(uri.host, uri.port, open_timeout: 5, read_timeout: 10) { |http| http.request(req) }
    raise Error, "sidecar poll #{res.code}: #{res.body}" unless res.code.to_i == 200
    JSON.parse(res.body)
  end

  def complete_tesco_login(login_id)
    body = "".to_json
    sig  = OpenSSL::HMAC.hexdigest("SHA256", secret, body)
    uri  = URI("#{base_url}/tesco-login/#{login_id}/complete")
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["X-Signature"]  = sig
    req.body = body
    res = Net::HTTP.start(uri.host, uri.port, open_timeout: 5, read_timeout: 30) { |http| http.request(req) }
    raise Error, "sidecar complete #{res.code}: #{res.body}" unless res.code.to_i == 200
    JSON.parse(res.body)
  end

  def capture_cookies(cdp_url:)
    body = { cdpUrl: cdp_url }.to_json
    sig  = OpenSSL::HMAC.hexdigest("SHA256", secret, body)
    uri  = URI("#{base_url}/capture-cookies")
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["X-Signature"]  = sig
    req.body = body
    res = Net::HTTP.start(uri.host, uri.port, open_timeout: 5, read_timeout: 15) { |http| http.request(req) }
    raise Error, "sidecar capture-cookies #{res.code}: #{res.body}" unless res.code.to_i == 200
    JSON.parse(res.body)
  end

  def cancel_tesco_login(login_id)
    body = "".to_json
    sig  = OpenSSL::HMAC.hexdigest("SHA256", secret, body)
    uri  = URI("#{base_url}/tesco-login/#{login_id}/cancel")
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["X-Signature"]  = sig
    req.body = body
    res = Net::HTTP.start(uri.host, uri.port, open_timeout: 5, read_timeout: 10) { |http| http.request(req) }
    # Don't raise on failure — cancellation is best-effort.
  end

  def send_existing_basket_decision(basket_build, action)
    body = { action: action }.to_json
    sig  = OpenSSL::HMAC.hexdigest("SHA256", secret, body)
    uri  = URI("#{base_url}/build/#{basket_build.id}/resume")
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["X-Signature"]  = sig
    req.body = body
    res = Net::HTTP.start(uri.host, uri.port, open_timeout: 5, read_timeout: 10) { |http| http.request(req) }
    unless res.code.to_i == 202
      raise Error, "sidecar resume #{res.code}: #{res.body}"
    end
    true
  end

  private

  def base_url
    ENV["SIDECAR_URL"].presence || "http://localhost:4001"
  end

  def secret
    ENV["SIDECAR_HMAC_SECRET"].presence || "dev-secret"
  end
end
