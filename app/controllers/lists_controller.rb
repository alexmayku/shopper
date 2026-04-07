class ListsController < ApplicationController
  def show
    @list = current_user.list
    @list_items = @list.list_items.to_a
    @new_item = ListItem.new
  end

  def clear
    current_user.list.list_items.destroy_all
    redirect_to list_path, notice: "List cleared.", status: :see_other
  end

  def rotate_share_token
    current_user.list.rotate_share_token!
    redirect_to list_path, notice: "Share link regenerated.", status: :see_other
  end
end
