require "net/http"

class SidecarClient
  class Error < StandardError; end

  def self.start_build(basket_build, callback_base_url:)
    new.start_build(basket_build, callback_base_url: callback_base_url)
  end

  def start_build(basket_build, callback_base_url:)
    user = basket_build.user
    payload = {
      buildId: basket_build.id,
      userId: user.id,
      tescoEmail: user.tesco_email,
      tescoPassword: user.tesco_password,
      items: basket_build.list_snapshot,
      preferences: {
        price_range: user.price_range,
        organic_preference: user.organic_preference,
      },
      railsCallbackBase: callback_base_url,
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

  private

  def base_url
    ENV["SIDECAR_URL"].presence || "http://localhost:4001"
  end

  def secret
    ENV["SIDECAR_HMAC_SECRET"].presence || "dev-secret"
  end
end
