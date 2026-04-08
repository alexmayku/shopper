class BasketBuildChannel
  CONNECTED_TTL = 60.seconds

  def self.connected?(basket_build_id)
    Rails.cache.read(cache_key(basket_build_id)).present?
  end

  def self.mark_connected(basket_build_id)
    Rails.cache.write(cache_key(basket_build_id), true, expires_in: CONNECTED_TTL)
  end

  def self.cache_key(basket_build_id)
    "build:#{basket_build_id}:connected"
  end
end
