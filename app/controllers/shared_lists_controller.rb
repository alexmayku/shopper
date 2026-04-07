class SharedListsController < ApplicationController
  include CollaboratorSessionsHelper

  allow_unauthenticated_access only: :show

  before_action :load_list

  def show
    @list_items = @list.list_items.to_a
    @new_item = ListItem.new
    @collaborator_session = ensure_collaborator_session_for(@list)
    @shared_mode = true
    render "lists/show"
  end

  private

  def load_list
    @list = List.find_by!(share_token: params[:share_token])
  rescue ActiveRecord::RecordNotFound
    render plain: "List not found", status: :not_found
  end
end
