module CollaboratorSessionsHelper
  extend ActiveSupport::Concern

  COOKIE_KEY = :collaborator_session_id

  private

  def ensure_collaborator_session_for(list)
    sid = cookies.signed[COOKIE_KEY]
    unless sid.present?
      sid = SecureRandom.urlsafe_base64(24)
      cookies.signed.permanent[COOKIE_KEY] = { value: sid, httponly: true, same_site: :lax }
    end
    record = list.collaborator_sessions.find_or_create_by!(session_id: sid)
    record.update!(last_seen_at: Time.current)
    record
  end
end
