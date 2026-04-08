class Internal::ProductMatchesController < ApplicationController
  include InternalHmacAuthentication

  skip_forgery_protection

  def show
    user = User.find(params[:user_id])
    match = ProductMatch.cached_for(user, params[:freeform_text].to_s)
    if match
      render json: serialize(match)
    else
      head :not_found
    end
  end

  def create
    user = User.find(params[:user_id])
    attrs = match_params.merge(user: user, last_used_at: Time.current)
    match = ProductMatch.find_or_initialize_by(user_id: user.id, freeform_text: attrs[:freeform_text])
    match.assign_attributes(attrs)
    if match.save
      render json: serialize(match), status: :created
    else
      render json: { errors: match.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def match_params
    params.permit(:freeform_text, :tesco_product_id, :tesco_product_name, :tesco_product_url, :price_pence, :confidence)
  end

  def serialize(match)
    {
      freeform_text: match.freeform_text,
      tesco_product_id: match.tesco_product_id,
      tesco_product_name: match.tesco_product_name,
      tesco_product_url: match.tesco_product_url,
      price_pence: match.price_pence,
      confidence: match.confidence,
    }
  end
end
