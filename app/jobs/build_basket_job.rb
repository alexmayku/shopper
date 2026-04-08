class BuildBasketJob < ApplicationJob
  queue_as :builds

  def perform(basket_build_id, callback_base_url:)
    basket_build = BasketBuild.find(basket_build_id)
    SidecarClient.start_build(basket_build, callback_base_url: callback_base_url)
  rescue SidecarClient::Error => e
    basket_build&.update(status: :failed, error_message: e.message)
  end
end
