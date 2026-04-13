class TescoSessionsController < ApplicationController
  before_action :require_authentication

  # POST /tesco_session — initiate login via sidecar
  def create
    result = SidecarClient.start_tesco_login
    session[:tesco_login_id] = result["loginId"]
    redirect_to edit_preferences_path, notice: "Tesco login started — complete sign-in in the browser window."
  rescue SidecarClient::Error => e
    redirect_to edit_preferences_path, alert: "Could not start Tesco login: #{e.message}"
  end

  # GET /tesco_session/poll — AJAX poll for login completion
  def poll
    login_id = session[:tesco_login_id]
    unless login_id
      return render json: { status: "no_session" }, status: :not_found
    end

    result = SidecarClient.poll_tesco_login(login_id)
    render json: result
  rescue SidecarClient::Error => e
    render json: { status: "error", error: e.message }, status: :unprocessable_entity
  end

  # POST /tesco_session/complete — capture cookies and save
  def complete
    login_id = session.delete(:tesco_login_id)
    unless login_id
      return redirect_to edit_preferences_path, alert: "No active login session."
    end

    result = SidecarClient.complete_tesco_login(login_id)
    storage_state = result["storageState"]

    current_user.update!(
      tesco_session_state: storage_state.is_a?(String) ? storage_state : storage_state.to_json,
      tesco_session_saved_at: Time.current
    )

    redirect_to edit_preferences_path, notice: "Tesco connected successfully."
  rescue SidecarClient::Error => e
    redirect_to edit_preferences_path, alert: "Could not save Tesco session: #{e.message}"
  end

  # DELETE /tesco_session — clear saved session
  def destroy
    login_id = session.delete(:tesco_login_id)
    SidecarClient.cancel_tesco_login(login_id) if login_id

    current_user.update!(tesco_session_state: nil, tesco_session_saved_at: nil)
    redirect_to edit_preferences_path, notice: "Tesco session cleared."
  end
end
