module AttributionHelper
  PALETTE = %w[
    bg-rose-500
    bg-amber-500
    bg-emerald-500
    bg-sky-500
    bg-violet-500
    bg-fuchsia-500
  ].freeze

  OWNER_COLOR = "bg-neutral-900".freeze

  # Color is a deterministic function of who added the item:
  # - the list owner always gets OWNER_COLOR
  # - anonymous collaborators are hashed into the PALETTE
  def attribution_color_for(list_item)
    if list_item.added_by_user_id.present?
      OWNER_COLOR
    else
      key = list_item.added_by_session_id.to_s
      return PALETTE.first if key.empty?
      PALETTE[Digest::SHA256.hexdigest(key).to_i(16) % PALETTE.length]
    end
  end

  def attribution_label_for(list_item, viewer: nil)
    case viewer
    when User
      list_item.added_by_user_id == viewer.id ? "Added by you" : "Added by partner"
    when String
      list_item.added_by_session_id == viewer ? "Added by you" : "Added by partner"
    else
      "Added by collaborator"
    end
  end
end
