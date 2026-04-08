class SendBasketReadyEmailJob < ApplicationJob
  queue_as :default

  def perform(basket_build_id)
    basket_build = BasketBuild.find(basket_build_id)
    BasketMailer.ready(basket_build).deliver_now
  end
end
