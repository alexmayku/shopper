class BasketBuildsController < ApplicationController
  before_action :require_authentication

  def show
    @basket_build = current_user.basket_builds.find(params[:id])
  end

  def create
    list = current_user.list
    snapshot = list.list_items.order(:position).map do |item|
      { freeform: item.freeform_text, quantity: item.quantity }
    end

    @basket_build = current_user.basket_builds.create!(
      list_snapshot: snapshot,
      status: :matching,
      progress_log: [],
      unmatched_items: [],
    )

    BuildBasketJob.perform_later(@basket_build.id, callback_base_url: callback_base_url)
    redirect_to @basket_build, status: :see_other
  end

  private

  def callback_base_url
    ENV["APP_HOST"].presence || request.base_url
  end
end
