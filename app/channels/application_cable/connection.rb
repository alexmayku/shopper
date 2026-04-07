module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user, :collaborator_session_id

    def connect
      set_current_user
      self.collaborator_session_id = cookies.signed[:collaborator_session_id]
    end

    private
      def set_current_user
        if session = Session.find_by(id: cookies.signed[:session_id])
          self.current_user = session.user
        end
      end
  end
end
