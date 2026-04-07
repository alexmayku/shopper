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
end
