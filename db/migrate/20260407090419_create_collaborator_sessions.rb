class CreateCollaboratorSessions < ActiveRecord::Migration[8.1]
  def change
    create_table :collaborator_sessions do |t|
      t.references :list, null: false, foreign_key: true
      t.string :session_id, null: false
      t.string :display_name
      t.datetime :last_seen_at

      t.timestamps
    end

    add_index :collaborator_sessions, [:list_id, :session_id], unique: true
  end
end
