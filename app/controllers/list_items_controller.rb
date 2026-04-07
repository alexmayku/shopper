class ListItemsController < ApplicationController
  before_action :set_list
  before_action :set_item, only: [:update, :destroy]

  def create
    next_position = (@list.list_items.maximum(:position) || 0) + 1
    @item = @list.list_items.new(item_params.merge(position: next_position, added_by_user: current_user))
    if @item.save
      redirect_to list_path, status: :see_other
    else
      redirect_to list_path, alert: @item.errors.full_messages.to_sentence, status: :see_other
    end
  end

  def update
    if @item.update(item_params)
      redirect_to list_path, status: :see_other
    else
      redirect_to list_path, alert: @item.errors.full_messages.to_sentence, status: :see_other
    end
  end

  def destroy
    @item.destroy
    redirect_to list_path, status: :see_other
  end

  private

  def set_list
    @list = current_user.list
  end

  def set_item
    @item = @list.list_items.find(params[:id])
  end

  def item_params
    params.require(:list_item).permit(:freeform_text, :quantity)
  end
end
