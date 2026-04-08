class Internal::BasketBuildCallbacksController < ApplicationController
  include InternalHmacAuthentication

  skip_forgery_protection

  before_action :load_build

  def progress
    @build.append_progress(progress_event)
    head :ok
  end

  def verification_required
    @build.update!(status: :paused_verification)
    @build.append_progress({ "event" => "verification_required", "at" => Time.current })
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
    head :ok
  end

  def failed
    @build.update!(status: :failed, error_message: params[:error_message])
    head :ok
  end

  private

  def load_build
    @build = BasketBuild.find(params[:id])
  end

  def progress_event
    params.permit!.to_h.except(:controller, :action, :id).merge("at" => Time.current.to_s)
  end
end
