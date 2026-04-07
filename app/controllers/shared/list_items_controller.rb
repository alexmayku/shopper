class Shared::ListItemsController < ApplicationController
  include CollaboratorSessionsHelper

  allow_unauthenticated_access

  before_action :load_list
  before_action :set_item, only: [:update, :destroy]

  def create
    next_position = (@list.list_items.maximum(:position) || 0) + 1
    cs = ensure_collaborator_session_for(@list)
    @item = @list.list_items.new(item_params.merge(position: next_position, added_by_session_id: cs.session_id))
    @item.save
    redirect_to shared_list_path(@list.share_token), status: :see_other
  end

  def update
    @item.update(item_params)
    redirect_to shared_list_path(@list.share_token), status: :see_other
  end

  def destroy
    @item.destroy
    redirect_to shared_list_path(@list.share_token), status: :see_other
  end

  private

  def load_list
    @list = List.find_by!(share_token: params[:share_token])
  end

  def set_item
    @item = @list.list_items.find(params[:id])
  end

  def item_params
    params.require(:list_item).permit(:freeform_text, :quantity)
  end
end
