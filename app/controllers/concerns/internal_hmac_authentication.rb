module InternalHmacAuthentication
  extend ActiveSupport::Concern

  included do
    skip_before_action :require_authentication, raise: false
    before_action :verify_internal_hmac
  end

  private

  def verify_internal_hmac
    secret = ENV["SIDECAR_HMAC_SECRET"].presence ||
             Rails.application.credentials.dig(:sidecar, :hmac_secret).presence ||
             "dev-secret"
    body = request.raw_post.to_s
    sig = request.headers["X-Signature"].to_s
    expected = OpenSSL::HMAC.hexdigest("SHA256", secret, body)
    unless ActiveSupport::SecurityUtils.secure_compare(expected, sig)
      head :unauthorized
    end
  end
end
