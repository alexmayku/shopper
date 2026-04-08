class BasketBuildsController < ApplicationController
  before_action :require_authentication

  def show
    @basket_build = current_user.basket_builds.find(params[:id])
    BasketBuildChannel.mark_connected(@basket_build.id)
  end

  def create
    if current_user.tesco_email.blank? || current_user.tesco_password.blank?
      return redirect_to edit_preferences_path,
                         alert: "Let's get you signed into Tesco first.",
                         status: :see_other
    end

    unless current_user.can_build_basket?
      @prices = Kart::PRICES
      return render "basket_builds/paywall", status: :payment_required
    end

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

  def correction_picker
    @basket_build = current_user.basket_builds.find(params[:id])
    @freeform = params[:freeform].to_s
    results =
      begin
        SidecarClient.search(@freeform)
      rescue SidecarClient::Error
        []
      end
    render partial: "basket_builds/correction_picker",
           locals: { basket_build: @basket_build, freeform: @freeform, results: results }
  end

  def corrections
    @basket_build = current_user.basket_builds.find(params[:id])
    freeform = params[:freeform_text].to_s.strip
    product_id = params[:tesco_product_id].to_s.strip
    if freeform.blank? || product_id.blank?
      return redirect_to @basket_build, alert: "Pick a product first.", status: :see_other
    end
    pm = ProductMatch.find_or_initialize_by(user_id: current_user.id, freeform_text: freeform)
    pm.tesco_product_id   = product_id
    pm.tesco_product_name = params[:tesco_product_name].to_s.presence || product_id
    pm.confidence         = 1.0
    pm.last_used_at       = Time.current
    pm.save!
    redirect_to @basket_build, notice: "Saved. Next time, '#{freeform}' will mean this product.", status: :see_other
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
