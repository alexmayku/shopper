class Internal::TescoSearchController < ApplicationController
  before_action :require_authentication

  def show
    query = params[:q].to_s
    if query.blank?
      return render json: { results: [] }
    end
    results = SidecarClient.search(query)
    render json: { results: results }
  rescue SidecarClient::Error => e
    render json: { error: e.message }, status: :bad_gateway
  end
end
