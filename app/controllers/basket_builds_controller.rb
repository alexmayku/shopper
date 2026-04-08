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

  def resume
    @basket_build = current_user.basket_builds.find(params[:id])
    unless @basket_build.paused_verification?
      return redirect_to @basket_build, alert: "Build isn't paused.", status: :see_other
    end
    SidecarClient.send_existing_basket_decision(@basket_build, "resume")
    @basket_build.update!(status: :building)
    @basket_build.append_progress({ "event" => "resumed", "at" => Time.current.to_s })
    redirect_to @basket_build, status: :see_other
  end

  def existing_basket_decision
    @basket_build = current_user.basket_builds.find(params[:id])
    action = params[:decision].to_s
    unless %w[replace merge cancel].include?(action)
      return redirect_to @basket_build, alert: "Invalid choice.", status: :see_other
    end
    SidecarClient.send_existing_basket_decision(@basket_build, action)
    @basket_build.append_progress({ "event" => "decision_sent", "decision" => action, "at" => Time.current.to_s })
    @basket_build.update!(status: :building) unless action == "cancel"
    redirect_to @basket_build, status: :see_other
  end

  private

  def callback_base_url
    ENV["APP_HOST"].presence || request.base_url
  end
end
