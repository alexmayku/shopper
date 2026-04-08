class Internal::BasketBuildCallbacksController < ApplicationController
  include InternalHmacAuthentication

  skip_forgery_protection

  before_action :load_build

  def progress
    @build.append_progress(progress_event)
    if @build.matching? && building_event?
      @build.update!(status: :building)
    end
    rebroadcast_status
    head :ok
  end

  def existing_basket_detected
    @build.update!(status: :paused_existing_basket)
    @build.append_progress({ "event" => "existing_basket_detected", "item_count" => params[:item_count].to_i, "at" => Time.current.to_s })
    rebroadcast_status
    head :ok
  end

  def verification_required
    @build.update!(status: :paused_verification)
    @build.append_progress({ "event" => "verification_required", "at" => Time.current })
    rebroadcast_status
    head :ok
  end

  def completed
    @build.update!(
      status: :ready,
      tesco_checkout_url: params[:tesco_checkout_url],
      total_pence: params[:total_pence],
      unmatched_items: Array(params[:unmatched_items]),
      completed_at: Time.current,
    )
    rebroadcast_status
    head :ok
  end

  def failed
    @build.update!(status: :failed, error_message: params[:error_message])
    rebroadcast_status
    head :ok
  end

  private

  def load_build
    @build = BasketBuild.find(params[:id])
  end

  def progress_event
    params.permit!.to_h.except(:controller, :action, :id).merge("at" => Time.current.to_s)
  end

  def building_event?
    %w[added unmatched item_error].include?(progress_event["event"].to_s)
  end

  def rebroadcast_status
    Turbo::StreamsChannel.broadcast_update_to(
      @build,
      target: helpers.dom_id(@build, :status),
      partial: "basket_builds/#{@build.status}",
      locals: { basket_build: @build }
    )
  end
end
